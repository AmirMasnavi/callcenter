package com.elmosanatearia.callcenter;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CallCenterApplication {
    public static void main(String[] args) {
        SpringApplication.run(CallCenterApplication.class, args);
    }
}
