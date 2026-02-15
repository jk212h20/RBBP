import { z } from 'zod';
import { EventStatus } from '@prisma/client';

export const createEventSchema = z.object({
  name: z.string().min(3, 'Event name must be at least 3 characters'),
  description: z.string().optional(),
  dateTime: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid date/time',
  }),
  registrationOpenDays: z.number().int().min(0).max(365).optional().default(10),
  registrationCloseMinutes: z.number().int().min(0).max(1440).optional().default(30),
  maxPlayers: z.number().int().min(2).max(200).optional().default(50),
  buyIn: z.number().min(0).optional(),
  venueId: z.string().min(1, 'Venue is required'),
  seasonId: z.string().min(1, 'Season is required'),
  directorId: z.string().optional(),
  status: z.nativeEnum(EventStatus).optional().default(EventStatus.SCHEDULED),
  lastLongerEnabled: z.boolean().optional().default(false),
  lastLongerSeedSats: z.number().int().min(0).optional().default(10000),
  lastLongerEntrySats: z.number().int().min(0).optional().default(25000),
});

export const updateEventSchema = z.object({
  name: z.string().min(3).optional(),
  description: z.string().optional().nullable(),
  dateTime: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid date/time',
  }).optional(),
  registrationOpenDays: z.number().int().min(0).max(365).optional(),
  registrationCloseMinutes: z.number().int().min(0).max(1440).optional(),
  maxPlayers: z.number().int().min(2).max(200).optional(),
  buyIn: z.number().min(0).optional().nullable(),
  venueId: z.string().optional(),
  seasonId: z.string().optional(),
  directorId: z.string().optional().nullable(),
  status: z.nativeEnum(EventStatus).optional(),
  lastLongerEnabled: z.boolean().optional(),
  lastLongerSeedSats: z.number().int().min(0).optional(),
  lastLongerEntrySats: z.number().int().min(0).optional(),
});

export const resultEntrySchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  position: z.number().int().min(1, 'Position must be at least 1'),
  knockouts: z.number().int().min(0).optional().default(0),
});

export const bulkResultsSchema = z.object({
  results: z.array(resultEntrySchema).min(1, 'At least one result is required'),
}).refine((data) => {
  const positions = data.results.map(r => r.position);
  return new Set(positions).size === positions.length;
}, {
  message: 'Duplicate positions are not allowed — each player must have a unique place',
  path: ['results'],
});

// Bulk event creation schema for recurring events
export const bulkCreateEventsSchema = z.object({
  baseName: z.string().min(3, 'Event name must be at least 3 characters'),
  description: z.string().optional(),
  startDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid start date',
  }),
  time: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  dayOfWeek: z.number().int().min(0).max(6), // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  numberOfWeeks: z.number().int().min(1).max(52, 'Maximum 52 weeks'),
  registrationOpenDays: z.number().int().min(0).max(365).optional().default(10),
  registrationCloseMinutes: z.number().int().min(0).max(1440).optional().default(30),
  maxPlayers: z.number().int().min(2).max(200).optional().default(50),
  buyIn: z.number().min(0).optional(),
  venueId: z.string().min(1, 'Venue is required'),
  seasonId: z.string().min(1, 'Season is required'),
  directorId: z.string().optional(),
  status: z.nativeEnum(EventStatus).optional().default(EventStatus.SCHEDULED),
  startingNumber: z.number().int().min(1).optional().default(1), // Starting # for naming
  lastLongerEnabled: z.boolean().optional().default(false),
  lastLongerSeedSats: z.number().int().min(0).optional().default(10000),
  lastLongerEntrySats: z.number().int().min(0).optional().default(25000),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type ResultEntry = z.infer<typeof resultEntrySchema>;
export type BulkResults = z.infer<typeof bulkResultsSchema>;
export type BulkCreateEventsInput = z.infer<typeof bulkCreateEventsSchema>;
