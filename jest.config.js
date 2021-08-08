const os = require('os');

module.exports = {
    clearMocks: true,
    moduleFileExtensions: ['js', 'ts'],
    testEnvironment: 'node',
    testMatch: ['**/test/*.test.ts'],
    testRunner: 'jest-circus/runner',
    transform: {
      '^.+\\.ts$': 'ts-jest'
    },
    verbose: false
}

const processStdoutWrite = process.stdout.write.bind(process.stdout)

process.stdout.write = (str, encoding, cb) => {
  let filteredStr = str.split(os.EOL).filter(line => !line.match(/^::/)).join(os.EOL)

  return processStdoutWrite(filteredStr, encoding, cb)
}
