package hr.zavrsni.incidentapp.security;

import hr.zavrsni.incidentapp.user.Role;
import hr.zavrsni.incidentapp.user.User;
import hr.zavrsni.incidentapp.user.UserRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * Exposes the two public auth endpoints:
 *   POST /api/auth/login     - verify credentials and return a JWT
 *   POST /api/auth/register  - create a REPORTER account and return a JWT
 *
 * Admin accounts are NOT created through register — they are seeded at startup
 * by DataSeeder. Opening admin self-registration would be a security hole.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthController(AuthenticationManager authenticationManager,
                          UserRepository userRepository,
                          PasswordEncoder passwordEncoder,
                          JwtService jwtService) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody AuthRequest req) {
        // Spring checks the password (BCrypt-matched) via the DaoAuthenticationProvider
        // that Spring Boot auto-configures when a UserDetailsService + PasswordEncoder
        // are present. Throws BadCredentialsException on mismatch.
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(req.username(), req.password()));

        // Pick the role out of the granted authorities (e.g. "ROLE_ADMIN" -> "ADMIN").
        String role = auth.getAuthorities().stream()
                .findFirst()
                .map(g -> g.getAuthority().replaceFirst("^ROLE_", ""))
                .orElse("REPORTER");

        String token = jwtService.generateToken(req.username(), role);
        return ResponseEntity.ok(new AuthResponse(token, req.username(), role));
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody AuthRequest req) {
        if (userRepository.existsByUsername(req.username())) {
            return ResponseEntity.badRequest().build();
        }
        User user = new User(
                req.username(),
                passwordEncoder.encode(req.password()),
                Role.REPORTER
        );
        userRepository.save(user);

        String token = jwtService.generateToken(user.getUsername(), Role.REPORTER.name());
        return ResponseEntity.ok(new AuthResponse(token, user.getUsername(), Role.REPORTER.name()));
    }
}
