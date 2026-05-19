package hr.zavrsni.incidentapp.notification;

import hr.zavrsni.incidentapp.incident.Incident;
import hr.zavrsni.incidentapp.incident.IncidentStatus;
import hr.zavrsni.incidentapp.user.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Sends transactional email notifications to incident reporters.
 *
 * The JavaMailSender bean is only created by Spring Boot when
 * SPRING_MAIL_HOST is set in the environment (see application.yml).
 * We inject it with required=false so the whole app boots cleanly
 * even when mail is not configured — notifyStatusChanged() just logs
 * and returns early in that case.
 *
 * MailException is caught (not propagated) so a temporary SMTP outage
 * never rolls back the incident status change transaction.
 */
@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String fromAddress;

    public void notifyStatusChanged(Incident incident, IncidentStatus newStatus) {
        if (mailSender == null || fromAddress.isBlank()) {
            log.debug("Mail not configured — skipping notification for incident #{}", incident.getId());
            return;
        }

        String reporterEmail = incident.getReporter().getEmail();
        if (reporterEmail == null || reporterEmail.isBlank()) {
            log.debug("Reporter {} has no email — skipping notification for incident #{}",
                    incident.getReporter().getUsername(), incident.getId());
            return;
        }

        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(fromAddress);
            msg.setTo(reporterEmail);
            msg.setSubject("Incident #" + incident.getId() + " — status changed to " + newStatus);
            msg.setText(
                    "Hi " + incident.getReporter().getUsername() + ",\n\n" +
                    "Your incident \"" + incident.getTitle() + "\" (#" + incident.getId() + ")\n" +
                    "has been updated to: " + newStatus + "\n\n" +
                    "Log in to view the full details and any comments.\n\n" +
                    "— Incident Management System"
            );
            mailSender.send(msg);
            log.info("Status notification sent to {} for incident #{}", reporterEmail, incident.getId());
        } catch (MailException e) {
            log.warn("Failed to send notification for incident #{}: {}", incident.getId(), e.getMessage());
        }
    }

    public void notifyAssigned(Incident incident, User assignee) {
        if (mailSender == null || fromAddress.isBlank()) {
            log.debug("Mail not configured — skipping assignment notification for incident #{}", incident.getId());
            return;
        }

        String assigneeEmail = assignee.getEmail();
        if (assigneeEmail == null || assigneeEmail.isBlank()) {
            log.debug("Assignee {} has no email — skipping assignment notification for incident #{}",
                    assignee.getUsername(), incident.getId());
            return;
        }

        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(fromAddress);
            msg.setTo(assigneeEmail);
            msg.setSubject("Incident #" + incident.getId() + " has been assigned to you");
            msg.setText(
                    "Hi " + assignee.getUsername() + ",\n\n" +
                    "You have been assigned to incident \"" + incident.getTitle() + "\" (#" + incident.getId() + ").\n" +
                    "Reported by: " + incident.getReporter().getUsername() + "\n" +
                    "Severity: " + incident.getSeverity() + "\n\n" +
                    "Log in to view the full details.\n\n" +
                    "— Incident Management System"
            );
            mailSender.send(msg);
            log.info("Assignment notification sent to {} for incident #{}", assigneeEmail, incident.getId());
        } catch (MailException e) {
            log.warn("Failed to send assignment notification for incident #{}: {}", incident.getId(), e.getMessage());
        }
    }
}
