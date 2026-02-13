/**
 * Main entry point for the Discord + Roblox Bot
 * Starts both the Discord bot and the Express API server
 */

import 'dotenv/config';
import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import express from 'express';
import cors from 'cors';
import { logger } from './lib/logger.js';
import prisma from './db/client.js';

// Import command files
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Validate environment variables
if (!process.env.DISCORD_TOKEN) {
  logger.error('DISCORD_TOKEN is not set in environment variables');
  process.exit(1);
}

if (!process.env.DISCORD_CLIENT_ID) {
  logger.error('DISCORD_CLIENT_ID is not set in environment variables');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  logger.error('DATABASE_URL is not set in environment variables');
  process.exit(1);
}

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

// Add commands collection to client
interface ExtendedClient extends Client {
  commands: Collection<string, any>;
}

(client as ExtendedClient).commands = new Collection();

// Recursive function to load commands from directories
async function loadCommandsFromDir(dir: string, commands: any[], clientExt: ExtendedClient) {
  const files = readdirSync(dir);

  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      // Recursively load from subdirectory
      await loadCommandsFromDir(filePath, commands, clientExt);
    } else if (file.endsWith('.js') || file.endsWith('.ts')) {
      // Load command file
      try {
        const command = await import(filePath);
        if ('data' in command && 'execute' in command) {
          clientExt.commands.set(command.data.name, command);
          commands.push(command.data.toJSON());
          logger.info(`Loaded command: ${command.data.name}`);
        }
      } catch (error) {
        logger.error(`Error loading command ${file}:`, error);
      }
    }
  }
}

// Load commands
const commandsPath = join(__dirname, 'commands');
const commands: any[] = [];
await loadCommandsFromDir(commandsPath, commands, client as ExtendedClient);

// Load events
const eventsPath = join(__dirname, 'events');
const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

for (const file of eventFiles) {
  const filePath = join(eventsPath, file);
  const event = await import(filePath);

  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
  logger.info(`Loaded event: ${event.name}`);
}

// Register slash commands
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    logger.info('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
      { body: commands },
    );

    logger.info('Successfully reloaded application (/) commands.');
  } catch (error) {
    logger.error('Error refreshing commands:', error);
  }
})();

// Login to Discord
client.login(process.env.DISCORD_TOKEN);

// Create Express API server
const app = express();
const PORT = process.env.API_PORT || process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Import API routes
import pointsRouter from './api/points.js';
import userRouter from './api/user.js';
import activityRouter from './api/activity.js';
import verifyRouter from './api/verify.js';
import moderationRouter from './api/moderation.js';

// Use routes
app.use('/api/points', pointsRouter);
app.use('/api/user', userRouter);
app.use('/api/activity', activityRouter);
app.use('/api/verify', verifyRouter);
app.use('/api/moderation', moderationRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('API Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start Express server
app.listen(PORT, () => {
  logger.info(`API server is running on port ${PORT}`);
  logger.info(`Health check available at http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await prisma.$disconnect();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down gracefully...');
  await prisma.$disconnect();
  client.destroy();
  process.exit(0);
});
