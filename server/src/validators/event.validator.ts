import { z } from 'zod';
import { EventStatus } from '@prisma/client';

export const createEventSchema = z.object({
  name: z.string().min(3, 'Event name must be at least 3 characters'),
  description: z.string().optional(),
  dateTime: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid date/time',
  }),
  maxPlayers: z.number().int().min(2).max(200).optional().default(50),
  buyIn: z.number().min(0).optional(),
  venueId: z.string().min(1, 'Venue is required'),
  seasonId: z.string().min(1, 'Season is required'),
  directorId: z.string().optional(),
  status: z.nativeEnum(EventStatus).optional().default(EventStatus.SCHEDULED),
});

export const updateEventSchema = z.object({
  name: z.string().min(3).optional(),
  description: z.string().optional().nullable(),
  dateTime: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid date/time',
  }).optional(),
  maxPlayers: z.number().int().min(2).max(200).optional(),
  buyIn: z.number().min(0).optional().nullable(),
  venueId: z.string().optional(),
  seasonId: z.string().optional(),
  directorId: z.string().optional().nullable(),
  status: z.nativeEnum(EventStatus).optional(),
});

export const resultEntrySchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  position: z.number().int().min(1, 'Position must be at least 1'),
  knockouts: z.number().int().min(0).optional().default(0),
});

export const bulkResultsSchema = z.object({
  results: z.array(resultEntrySchema).min(1, 'At least one result is required'),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type ResultEntry = z.infer<typeof resultEntrySchema>;
export type BulkResults = z.infer<typeof bulkResultsSchema>;
