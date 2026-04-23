package hr.zavrsni.incidentapp.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * Spring Data JPA generates an implementation of this interface at runtime.
 * You get CRUD methods (save, findById, findAll, delete, ...) for free.
 *
 * Custom finders are derived from the method name: findByUsername(String)
 * becomes SELECT ... FROM users WHERE username = ?.
 */
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    boolean existsByUsername(String username);
}
