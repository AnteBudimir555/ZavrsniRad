package hr.zavrsni.incidentapp.comment;

import hr.zavrsni.incidentapp.comment.dto.AddCommentRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * REST endpoints for comments nested under incidents.
 * No @PreAuthorize needed at the class level — both roles can interact
 * with comments, but the service enforces who can touch which incident.
 */
@RestController
@RequestMapping("/api/incidents/{incidentId}/comments")
public class CommentController {

    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
    }

    @PostMapping
    public ResponseEntity<CommentDto> addComment(@PathVariable Long incidentId,
                                                  @Valid @RequestBody AddCommentRequest req,
                                                  Authentication auth) {
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        CommentDto created = commentService.addComment(incidentId, req.body(), auth.getName(), isAdmin);
        return ResponseEntity.ok(created);
    }

    @GetMapping
    public List<CommentDto> listComments(@PathVariable Long incidentId, Authentication auth) {
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        return commentService.listComments(incidentId, auth.getName(), isAdmin);
    }
}
