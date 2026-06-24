-- ============================================================
-- Add an "all-day" flag to events.
--
-- Timed events keep their exact startAt/endAt.
-- All-day events are stored as midnight..(last day + 1) midnight, so the
-- existing CHECK ("startAt" < "endAt") still holds and the [start, end)
-- half-open range covers every day the event spans.
-- ============================================================

ALTER TABLE events
  ADD COLUMN "isAllDay" boolean NOT NULL DEFAULT false;
