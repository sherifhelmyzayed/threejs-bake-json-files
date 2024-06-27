  module.exports = {
    failZero: false,
    parallel: true,
    spec: ['./**/*.test.ts'],
    require: [
      __dirname + '/mocha.env',
      'ts-node/register'
    ],
    extension: [
      'ts'
    ],
    exit: true,
    recursive: true,
    jobs: '1',
    timeout: '300000'
  };