
const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
  SUCCESS: 'SUCCESS'
};

const COLORS = {
  ERROR: '\x1b[31m',   
  WARN: '\x1b[33m',    
  INFO: '\x1b[36m',    
  DEBUG: '\x1b[35m',   
  SUCCESS: '\x1b[32m', 
  RESET: '\x1b[0m'
};

class Logger {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.logLevel = process.env.LOG_LEVEL || (this.isProduction ? 'INFO' : 'DEBUG');
  }

 
  _formatMessage(level, message, context = '') {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` [${context}]` : '';
    return `${timestamp} ${level}${contextStr}: ${message}`;
  }

 
  _shouldLog(level) {
    const levels = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  _log(level, message, context = '', data = null) {
    if (!this._shouldLog(level)) return;

    const color = COLORS[level] || COLORS.RESET;
    const formattedMessage = this._formatMessage(level, message, context);
    
    if (this.isProduction) {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        context,
        message,
        ...(data && { data })
      }));
    } else {

      console.log(`${color}${formattedMessage}${COLORS.RESET}`);
      if (data) {
        console.log(`${color}Data:${COLORS.RESET}`, data);
      }
    }
  }

 
  error(message, context = '', error = null) {
    this._log(LOG_LEVELS.ERROR, message, context);
    if (error) {
      if (error instanceof Error) {
        console.error(`${COLORS.ERROR}Stack:${COLORS.RESET}`, error.stack);
      } else {
        console.error(`${COLORS.ERROR}Error Details:${COLORS.RESET}`, error);
      }
    }
    console.error('==========================================');
  }

  warn(message, context = '', data = null) {
    this._log(LOG_LEVELS.WARN, message, context, data);
  }

  info(message, context = '', data = null) {
    this._log(LOG_LEVELS.INFO, message, context, data);
    if (context === 'Server' || context === 'Database') {
      console.info('==========================================');
    }
  }

  debug(message, context = '', data = null) {
    if (!this.isProduction) {
      this._log(LOG_LEVELS.DEBUG, message, context, data);
    }
  }

  success(message, context = '', data = null) {
    this._log(LOG_LEVELS.SUCCESS, message, context, data);
    console.log('==========================================');
  }

  database(operation, message, data = null) {
    this.info(`[DB:${operation}] ${message}`, 'Database', data);
  }

  request(method, path, statusCode, duration = null) {
    const durationStr = duration ? ` (${duration}ms)` : '';
    const status = statusCode >= 400 ? 'ERROR' : 'INFO';
    this._log(
      status,
      `${method} ${path} - ${statusCode}${durationStr}`,
      'API'
    );
  }

  auth(event, userId, success, details = '') {
    const level = success ? LOG_LEVELS.SUCCESS : LOG_LEVELS.WARN;
    const message = `${event} - User: ${userId} - ${success ? 'SUCCESS' : 'FAILED'} ${details}`;
    this._log(level, message, 'Auth');
  }
}

const logger = new Logger();
export default logger;
