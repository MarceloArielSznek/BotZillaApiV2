// Setup global para tests
require('dotenv').config({ path: '.env.test' });

// Mock del logger para testing
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
    authEvent: jest.fn(),
    businessEvent: jest.fn(),
    apiError: jest.fn(),
    databaseQuery: jest.fn()
  },
  requestLogger: (req, res, next) => next(),
  errorLogger: (err, req, res, next) => next(err)
}));

// Variables de entorno para testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-very-secure';
process.env.LOG_LEVEL = 'ERROR'; // Solo errores en tests
process.env.LOG_TO_FILE = 'false';
process.env.LOG_TO_CONSOLE = 'false';

// Configuración global de Jest
beforeAll(async () => {
  console.log('🧪 Setting up test environment...');
});

afterAll(async () => {
  console.log('🧹 Cleaning up test environment...');
});

// Limpiar entre tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Helper para crear request mock
global.createMockRequest = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: null,
  ip: '127.0.0.1',
  get: jest.fn((header) => {
    const headers = {
      'user-agent': 'test-agent',
      'authorization': 'Bearer test-token',
      ...overrides.headers
    };
    return headers[header.toLowerCase()];
  }),
  ...overrides
});

// Helper para crear response mock
global.createMockResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
    statusCode: 200
  };
  return res;
};

// Helper para crear next mock
global.createMockNext = () => jest.fn();

// Helper para crear usuario mock
global.createMockUser = (overrides = {}) => ({
  id: 1,
  email: 'test@example.com',
  password: '$2a$10$hashedpassword',
  rol: {
    id: 1,
    name: 'admin'
  },
  toJSON: function() {
    return {
      id: this.id,
      email: this.email,
      rol: this.rol
    };
  },
  ...overrides
});

// Helper para promesas que deben fallar
global.expectToThrow = async (promise) => {
  let error;
  try {
    await promise;
  } catch (e) {
    error = e;
  }
  expect(error).toBeDefined();
  return error;
}; 