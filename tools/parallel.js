export async function runInParallel(tools, runner, { concurrency = 4 } = {}) {
  const results = [];
  const queue = [...tools];
  let active = 0;

  return new Promise(resolve => {
    function next() {
      if (queue.length === 0 && active === 0) {
        resolve(results);
        return;
      }

      while (active < concurrency && queue.length > 0) {
        const tool = queue.shift();
        active++;

        runner(tool)
          .then(result => {
            results.push(result);
          })
          .catch(err => {
            results.push({ name: tool.name, passed: false, error: err });
          })
          .finally(() => {
            active--;
            next();
          });
      }
    }

    next();
  });
}
