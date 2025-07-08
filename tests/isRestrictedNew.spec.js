import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TimeSlotRestriction,
  TotalTimeRestriction,
  ConsecutiveTimeRestriction,
} from "../worker/restrictions";
import { Site, Group } from '../worker/siteAndGroupModels';
import { RecordManager } from '../worker/recordManager';
import { EntitiesCache } from '../worker/siteAndGroupModels';