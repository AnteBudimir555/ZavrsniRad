package hr.zavrsni.incidentapp.user;

import jakarta.persistence.EntityNotFoundException;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * Business-logic layer for user-management actions used by the admin UI.
 * Controllers stay thin (parse the request, return the response); the rules
 * about "who is allowed to do what" live here so they can be unit-tested
 * without HTTP plumbing.
 */
@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<UserDto> listAll() {
        return userRepository.findAll(Sort.by("username")).stream()
                .map(UserDto::from)
                .toList();
    }

    @Transactional
    public UserDto setActive(Long userId, boolean active, String actorUsername) {
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + userId));

        // Self-deactivation guard. An admin who locks themselves out at 3 a.m.
        // has no in-app way back: only another admin or a DB UPDATE can flip
        // the flag again. Refusing the operation here is cheaper than
        // recovering from it.
        if (!active && target.getUsername().equals(actorUsername)) {
            throw new AccessDeniedException("You cannot deactivate your own account.");
        }

        target.setActive(active);
        return UserDto.from(target);
    }
}
