package com.elmosanatearia.callcenter.user;

public enum Role {
    AGENT,
    SUPERVISOR,
    MANAGER,
    /** Records staff arrivals and departures at the front desk. */
    OFFICE_MANAGER,
    /** Reads worked hours and performance together, for payroll. */
    PAYROLL,
    ADMIN
}
