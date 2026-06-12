CREATE TYPE "SegmentCreator" AS ENUM ('ai', 'human');

ALTER TABLE "Segment"
  ALTER COLUMN "createdBy" TYPE "SegmentCreator"
  USING "createdBy"::"SegmentCreator";
