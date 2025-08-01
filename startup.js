#!/usr/bin/env node

/**
 * Custom Startup Script for Wins Column
 * 
 * This script initializes the job processing system before starting the Next.js server.
 * This is necessary because instrumentation hooks don't work with Next.js standalone output.
 */

const { spawn } = require('child_process');
const path = require('path');

async function initializeJobSystem() {
  console.log('🚀 [Startup] Initializing job processing system...');
  
  try {
    // Import and initialize the job system
    const { initializeJobSystem } = require('./src/lib/startup/job-system-startup');
    await initializeJobSystem();
    
    console.log('✅ [Startup] Job processing system initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ [Startup] Failed to initialize job processing system:', error);
    console.error('⚠️  [Startup] Continuing without job processing. Check configuration and restart.');
    return false;
  }
}

async function startServer() {
  console.log('🚀 [Startup] Starting Next.js server...');
  
  // Start the Next.js server
  const server = spawn('node', ['server.js'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'production',
      NEXT_RUNTIME: 'nodejs'
    }
  });

  // Handle server process events
  server.on('error', (error) => {
    console.error('❌ [Startup] Failed to start server:', error);
    process.exit(1);
  });

  server.on('exit', (code) => {
    console.log(`[Startup] Server exited with code ${code}`);
    process.exit(code);
  });

  // Handle process signals
  process.on('SIGTERM', () => {
    console.log('🛑 [Startup] Received SIGTERM, shutting down gracefully...');
    server.kill('SIGTERM');
  });

  process.on('SIGINT', () => {
    console.log('🛑 [Startup] Received SIGINT, shutting down gracefully...');
    server.kill('SIGINT');
  });
}

async function main() {
  console.log('🚀 [Startup] Starting Wins Column application...');
  console.log('🔍 [Startup] Environment:', process.env.NODE_ENV);
  console.log('🔍 [Startup] NEXT_RUNTIME:', process.env.NEXT_RUNTIME);
  
  try {
    // Initialize job processing system
    const jobSystemInitialized = await initializeJobSystem();
    
    if (jobSystemInitialized) {
      console.log('✅ [Startup] Job processing system ready');
    } else {
      console.log('⚠️  [Startup] Job processing system not available');
    }
    
    // Start the Next.js server
    await startServer();
    
  } catch (error) {
    console.error('❌ [Startup] Failed to start application:', error);
    process.exit(1);
  }
}

// Run the startup sequence
main().catch((error) => {
  console.error('❌ [Startup] Unhandled error:', error);
  process.exit(1);
}); 