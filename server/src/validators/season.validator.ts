import { z } from 'zod';

export const createSeasonSchema = z.object({
  name: z.string().min(2, 'Season name must be at least 2 characters'),
  startDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid start date',
  }),
  endDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid end date',
  }),
  isActive: z.boolean().optional().default(false),
  playoffQualifyCount: z.number().int().min(1).optional().default(10),
}).refine((data) => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  return end > start;
}, {
  message: 'End date must be after start date',
  path: ['endDate'],
});

export const updateSeasonSchema = z.object({
  name: z.string().min(2).optional(),
  startDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid start date',
  }).optional(),
  endDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid end date',
  }).optional(),
  isActive: z.boolean().optional(),
  playoffQualifyCount: z.number().int().min(1).optional(),
});

export type CreateSeasonInput = z.infer<typeof createSeasonSchema>;
export type UpdateSeasonInput = z.infer<typeof updateSeasonSchema>;
