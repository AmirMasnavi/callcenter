package com.elmosanatearia.callcenter.audit;
import com.elmosanatearia.callcenter.user.AppUser;
import jakarta.persistence.*;
import java.time.Instant;
@Entity @Table(name="audit_events")
public class AuditEvent {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="actor_id") private AppUser actor;
 @Column(nullable=false) private String action;
 @Column(name="entity_type",nullable=false) private String entityType;
 @Column(name="entity_id") private String entityId;
 @Column(columnDefinition="text") private String metadata;
 @Column(name="created_at",nullable=false) private Instant createdAt=Instant.now();
 public AuditEvent(){}
 public AuditEvent(AppUser actor,String action,String type,String id,String metadata){this.actor=actor;this.action=action;entityType=type;entityId=id;this.metadata=metadata;}
 public Long getId(){return id;} public AppUser getActor(){return actor;} public String getAction(){return action;}
 public String getEntityType(){return entityType;} public String getEntityId(){return entityId;} public String getMetadata(){return metadata;} public Instant getCreatedAt(){return createdAt;}
}
