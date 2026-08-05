package com.elmosanatearia.callcenter.settings;

import jakarta.persistence.*;

/** A single runtime setting an admin can change without a redeploy. */
@Entity @Table(name = "app_settings")
public class AppSetting {
    @Id @Column(name = "key", length = 64)
    private String key;

    @Column(name = "value", nullable = false, length = 256)
    private String value;

    protected AppSetting() {}
    public AppSetting(String key, String value) { this.key = key; this.value = value; }

    public String getKey() { return key; }
    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }
}
