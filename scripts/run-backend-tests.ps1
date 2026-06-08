<#
    run-backend-tests.ps1
    =====================
    Runs the backend test suite without needing Maven or a JDK installed on the
    host. It:

      1. starts a throwaway PostgreSQL 16 container on a private Docker network,
      2. runs `mvn test` inside the SAME Maven image the Dockerfile uses, on that
         network, pointing Spring's datasource at the throwaway Postgres,
      3. tears the database container + network down again afterwards.

    The Maven local repository is cached in the named volume `incidentapp-m2`
    so repeat runs are fast.

    Why a real Postgres instead of an in-memory H2 DB?
      The Flyway migrations (V1..V6) are PostgreSQL-specific and the app boots
      with `ddl-auto: validate`, so the tests must run against real Postgres to
      be meaningful — exactly the database the app uses in production.

    Usage (from anywhere):
        powershell -File scripts/run-backend-tests.ps1
        powershell -File scripts/run-backend-tests.ps1 "-Dtest=SmokeApiTests"   # pass extra mvn args
#>

# NOTE: we deliberately do NOT set $ErrorActionPreference = "Stop". In Windows
# PowerShell 5.1, native-command stderr (e.g. `docker rm` on a container that
# doesn't exist yet during pre-run cleanup) is wrapped as a terminating error
# under "Stop", which would abort the script before it even starts. Instead we
# check $LASTEXITCODE explicitly on the steps that must succeed and `throw`
# there (throw always terminates regardless of the preference).

# --- resolve paths -----------------------------------------------------------
$repoRoot    = Split-Path -Parent $PSScriptRoot
$backendDir  = Join-Path $repoRoot "backend"
$backendMnt  = ($backendDir -replace '\\', '/')   # Docker wants forward slashes

# --- config ------------------------------------------------------------------
$network   = "incidentapp-test-net"
$pgName     = "incidentapp-test-pg"
$mavenImage = "maven:3.9-eclipse-temurin-21"
$m2Volume   = "incidentapp-m2"
$dbName     = "incidents_test"
$dbUser     = "incident_user"
$dbPass     = "test_pw"

function Cleanup {
    Write-Host "`n--- cleaning up test database ---" -ForegroundColor Cyan
    docker rm -f $pgName 2>$null | Out-Null
    docker network rm $network 2>$null | Out-Null
}

try {
    # Start from a clean slate in case a previous run was interrupted.
    Cleanup

    Write-Host "--- creating network + starting Postgres ---" -ForegroundColor Cyan
    docker network create $network | Out-Null
    docker run -d --name $pgName --network $network `
        -e POSTGRES_DB=$dbName `
        -e POSTGRES_USER=$dbUser `
        -e POSTGRES_PASSWORD=$dbPass `
        postgres:16-alpine | Out-Null

    # Wait until Postgres accepts connections (max ~30s).
    Write-Host "--- waiting for Postgres to be ready ---" -ForegroundColor Cyan
    $ready = $false
    foreach ($i in 1..30) {
        docker exec $pgName pg_isready -U $dbUser -d $dbName 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) { throw "Postgres did not become ready in time." }

    Write-Host "--- running mvn test ---" -ForegroundColor Cyan
    docker run --rm --network $network `
        -v "${backendMnt}:/app" `
        -v "${m2Volume}:/root/.m2" `
        -e SPRING_DATASOURCE_URL="jdbc:postgresql://${pgName}:5432/${dbName}" `
        -e SPRING_DATASOURCE_USERNAME=$dbUser `
        -e SPRING_DATASOURCE_PASSWORD=$dbPass `
        -w /app $mavenImage mvn -B test @args

    $testExit = $LASTEXITCODE
    if ($testExit -eq 0) {
        Write-Host "`nBUILD/TEST SUCCESS" -ForegroundColor Green
    } else {
        Write-Host "`nTESTS FAILED (exit $testExit)" -ForegroundColor Red
    }
    exit $testExit
}
finally {
    Cleanup
}
