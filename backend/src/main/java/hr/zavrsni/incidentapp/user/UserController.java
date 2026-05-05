package hr.zavrsni.incidentapp.user;

import hr.zavrsni.incidentapp.user.dto.UpdateUserRequest;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * Admin-only endpoints for managing user accounts: list everyone and toggle
 * the 'active' flag. The class-level @PreAuthorize gates every method to
 * ROLE_ADMIN; the service layer adds the business rule that an admin may
 * not deactivate their own account.
 */
@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public List<UserDto> listAll() {
        return userService.listAll();
    }

    @PatchMapping("/{id}")
    public UserDto update(@PathVariable Long id,
                          @Valid @RequestBody UpdateUserRequest req,
                          @AuthenticationPrincipal UserDetails actor) {
        return userService.setActive(id, req.active(), actor.getUsername());
    }
}
