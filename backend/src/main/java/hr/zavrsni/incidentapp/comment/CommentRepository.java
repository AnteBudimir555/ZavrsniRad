package hr.zavrsni.incidentapp.comment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CommentRepository extends JpaRepository<Comment, Long> {
    List<Comment> findByIncident_IdOrderByCreatedAtAsc(Long incidentId);
}
