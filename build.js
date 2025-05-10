// build.js
const { glob } = require('glob');
const concat = require('concat-files');

const sourcePattern = 'src/**/*.ts';
const output = 'sum.ts';

(async () => {
  try {
    const files = await glob(sourcePattern);
    if (!files.length) {
      console.log('❗️파일이 하나도 없습니다.');
      return;
    }

    concat(files, output, (err) => {
      if (err) throw err;
      console.log('✅ 생성 완료:', output);
    });
  } catch (err) {
    console.error('에러 발생:', err);
  }
})();
