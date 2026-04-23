package hr.zavrsni.incidentapp.security;

import hr.zavrsni.incidentapp.config.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * A JWT (JSON Web Token) is a signed string that encodes a few "claims" about
 * the user (their username, role, expiry). The backend can hand it to the
 * frontend on login; the frontend then sends it back on every request in the
 * "Authorization: Bearer ..." header, and the backend verifies the signature
 * to know the request is authentic.
 *
 * This service does two things:
 *   1) generate a signed token for a given username + role
 *   2) parse + verify an incoming token, returning the claims
 */
@Service
public class JwtService {

    private final SecretKey signingKey;
    private final long expirationMs;

    public JwtService(AppProperties props) {
        // If the secret looks like Base64, decode it — otherwise treat as raw UTF-8 bytes.
        // Either way we need >= 32 bytes for HS256.
        String secret = props.jwt().secret();
        byte[] keyBytes;
        try {
            keyBytes = Decoders.BASE64.decode(secret);
            if (keyBytes.length < 32) {
                keyBytes = secret.getBytes(StandardCharsets.UTF_8);
            }
        } catch (IllegalArgumentException e) {
            keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
        this.expirationMs = props.jwt().expirationMs();
    }

    /** Build a JWT with subject = username and a custom "role" claim. */
    public String generateToken(String username, String role) {
        Date now = new Date();
        Date exp = new Date(now.getTime() + expirationMs);
        return Jwts.builder()
                .subject(username)
                .claims(Map.of("role", role))
                .issuedAt(now)
                .expiration(exp)
                .signWith(signingKey)
                .compact();
    }

    /** Returns the claims object if the token is valid; throws otherwise. */
    public Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String extractUsername(String token) {
        return parse(token).getSubject();
    }
}
