import { z } from 'zod';

// Default points structure for poker tournaments
export const defaultPointsStructure = {
  "1": 100,
  "2": 80,
  "3": 65,
  "4": 55,
  "5": 45,
  "6": 40,
  "7": 35,
  "8": 30,
  "9": 25,
  "10": 20,
  "11-15": 15,
  "16-20": 10,
  "21+": 5,
  "knockout": 2,
  "participation": 5
};

export const createSeasonSchema = z.object({
  name: z.string().min(2, 'Season name must be at least 2 characters'),
  startDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid start date',
  }),
  endDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid end date',
  }),
  isActive: z.boolean().optional().default(false),
  pointsStructure: z.record(z.string(), z.number()).optional(),
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
  pointsStructure: z.record(z.string(), z.number()).optional(),
  playoffQualifyCount: z.number().int().min(1).optional(),
});

export type CreateSeasonInput = z.infer<typeof createSeasonSchema>;
export type UpdateSeasonInput = z.infer<typeof updateSeasonSchema>;
