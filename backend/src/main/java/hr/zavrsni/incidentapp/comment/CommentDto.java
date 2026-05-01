package hr.zavrsni.incidentapp.comment;

import java.time.Instant;

public record CommentDto(
        Long id,
        String body,
        String authorUsername,
        Long incidentId,
        Instant createdAt
) {
    public static CommentDto from(Comment comment) {
        return new CommentDto(
                comment.getId(),
                comment.getBody(),
                comment.getAuthor().getUsername(),
                comment.getIncident().getId(),
                comment.getCreatedAt()
        );
    }
}
