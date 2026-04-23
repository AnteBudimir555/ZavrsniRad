package hr.zavrsni.incidentapp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * This is the entry point of the Spring Boot application — the class with main()
 * that starts the embedded Tomcat, wires up all @Component / @Service / @RestController
 * classes, and reads application.yml.
 *
 * @SpringBootApplication is a shortcut combining three annotations:
 *   - @Configuration       (this class can define beans)
 *   - @EnableAutoConfiguration (Spring looks at classpath and configures itself)
 *   - @ComponentScan       (Spring scans this package + sub-packages for annotations)
 */
@SpringBootApplication
public class IncidentAppApplication {

    public static void main(String[] args) {
        SpringApplication.run(IncidentAppApplication.class, args);
    }
}
