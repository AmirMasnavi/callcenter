-- Attendance is the number who actually turned up in class after the calls — the figure
-- that says whether the outreach worked, as opposed to how many people were reached.
--
-- Nullable on purpose: it is only known after the class has run, so a report can be
-- submitted and approved before anyone can fill it in.
ALTER TABLE daily_reports ADD COLUMN attendee_count INTEGER
  CHECK (attendee_count IS NULL OR attendee_count >= 0);

-- Which school was called. Managers compare outcomes per school, not only per operator,
-- and a free-text report label is too unreliable to group by.
ALTER TABLE daily_reports ADD COLUMN school VARCHAR(160);

CREATE INDEX idx_reports_school ON daily_reports(school) WHERE school IS NOT NULL;
