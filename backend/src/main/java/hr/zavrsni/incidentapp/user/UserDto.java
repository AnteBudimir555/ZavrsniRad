package hr.zavrsni.incidentapp.user;

public record UserDto(Long id, String username, String role) {
    public static UserDto from(User user) {
        return new UserDto(user.getId(), user.getUsername(), user.getRole().name());
    }
}
