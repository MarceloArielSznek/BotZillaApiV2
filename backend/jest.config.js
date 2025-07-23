module.exports = {
  // Entorno de testing
  testEnvironment: 'node',
  
  // Directorio raíz
  rootDir: '.',
  
  // Patrones para encontrar archivos de test
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Directorios a ignorar
  testPathIgnorePatterns: [
    '/node_modules/',
    '/logs/',
    '/dist/',
    'setup.js'
  ],
  
  // Coverage settings
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/logs/',
    '/coverage/',
    'jest.config.js'
  ],
  
  // Qué archivos incluir en coverage
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/scripts/**',
    '!src/seeders/**'
  ],
  
  // Umbrales de coverage
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.js'],
  
  // Variables de entorno para testing
  testEnvironmentOptions: {
    NODE_ENV: 'test'
  },
  
  // Limpiar mocks automáticamente
  clearMocks: true,
  
  // Reportes
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './coverage',
      filename: 'test-report.html',
      expand: true
    }]
  ],
  
  // Timeout para tests
  testTimeout: 10000,
  
  // Mock patterns  
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  }
}; 