package hr.zavrsni.incidentapp.user;

import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * Bridge between our domain User and Spring Security's UserDetails abstraction.
 * Spring's authentication machinery calls loadUserByUsername(...) to fetch the
 * principal — we return a Spring-shaped object wrapping our JPA entity.
 *
 * Note the "ROLE_" prefix — Spring's hasRole("ADMIN") actually matches authority
 * "ROLE_ADMIN". If you forget the prefix, every role check silently fails.
 */
@Service
public class AppUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public AppUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));

        return new org.springframework.security.core.userdetails.User(
                user.getUsername(),
                user.getPassword(),
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))
        );
    }
}
