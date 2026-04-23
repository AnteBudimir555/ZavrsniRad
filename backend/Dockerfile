# WHY THIS FILE EXISTS
# --------------------
# A "multi-stage" Dockerfile builds the jar inside a temporary "build" image
# (which contains Maven + JDK) and then copies ONLY the final .jar into a small
# runtime image. The final image therefore doesn't ship Maven or the Java compiler,
# which keeps it small and reduces attack surface.

# ---------- Stage 1: build ----------
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

# Copy the POM first and resolve dependencies separately.
# This layer is cached as long as pom.xml doesn't change -> faster rebuilds
# when you only change Java source files.
COPY pom.xml .
RUN mvn -B -q -DskipTests dependency:go-offline

# Now copy the source and build the jar.
COPY src ./src
RUN mvn -B -q -DskipTests package

# ---------- Stage 2: runtime ----------
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Create a non-root user (security best practice — never run a web app as root).
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

# Copy the built jar from the build stage.
COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]
