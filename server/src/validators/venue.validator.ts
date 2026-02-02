import { z } from 'zod';

// Custom validator for imageUrl - accepts URL, base64 data, or empty/null
const imageUrlSchema = z.string().optional().nullable().refine(
  (val) => {
    if (!val || val === '') return true; // Allow empty/null
    if (val.startsWith('data:image/')) return true; // Allow base64
    try {
      new URL(val);
      return true; // Allow valid URLs
    } catch {
      return false;
    }
  },
  { message: 'Must be a valid URL or base64 image data' }
);

export const createVenueSchema = z.object({
  name: z.string().min(2, 'Venue name must be at least 2 characters'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  description: z.string().optional(),
  imageUrl: imageUrlSchema,
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
});

export const updateVenueSchema = createVenueSchema.partial();

export type CreateVenueInput = z.infer<typeof createVenueSchema>;
export type UpdateVenueInput = z.infer<typeof updateVenueSchema>;
