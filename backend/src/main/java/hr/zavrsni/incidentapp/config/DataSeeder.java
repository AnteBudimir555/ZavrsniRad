package hr.zavrsni.incidentapp.config;

import hr.zavrsni.incidentapp.user.Role;
import hr.zavrsni.incidentapp.user.User;
import hr.zavrsni.incidentapp.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * On the very first startup there are no users in the database, so nobody can
 * log in as admin. This CommandLineRunner runs once at boot: if an admin user
 * does not yet exist, it creates one using credentials from AppProperties
 * (which in turn come from the .env file).
 *
 * CommandLineRunner is a Spring-specific interface: any bean implementing it
 * has its run(...) method invoked after the context is fully initialised.
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AppProperties props;

    public DataSeeder(UserRepository userRepository,
                      PasswordEncoder passwordEncoder,
                      AppProperties props) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.props = props;
    }

    @Override
    public void run(String... args) {
        String username = props.admin().username();
        if (userRepository.existsByUsername(username)) {
            log.info("Admin user '{}' already exists — skipping seeding.", username);
            return;
        }
        User admin = new User(
                username,
                passwordEncoder.encode(props.admin().password()),
                Role.ADMIN
        );
        userRepository.save(admin);
        log.info("Seeded default admin user '{}'.", username);
    }
}
