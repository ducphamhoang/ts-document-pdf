import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import config from './infrastructure/config';
import { loggingMiddleware } from './presentation/middleware/logging.middleware';
import { errorMiddleware } from './presentation/middleware/error.middleware';

import createConversionRoutes from './presentation/routes/conversion.routes';
import createDownloadRoutes from './presentation/routes/download.routes';
import { conversionController } from './shared/services';

const app: Application = express();

// Security middleware
app.use(helmet());

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json({ 
  limit: `${config.files.maxFileSizeMB}mb` 
}));

// Parse URL-encoded bodies
app.use(express.urlencoded({ 
  extended: true,
  limit: `${config.files.maxFileSizeMB}mb` 
}));

// Logging middleware
app.use(loggingMiddleware);

// Import and use routes
const conversionRoutes = createConversionRoutes(conversionController);
const downloadRoutes = createDownloadRoutes(conversionController);

app.use('/api/v1', conversionRoutes);
app.use('/', downloadRoutes);

// Error handling middleware (should be last)
app.use(errorMiddleware);

export default app;