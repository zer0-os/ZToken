/* eslint-disable prefer-arrow/prefer-arrow-functions */
function checkExponent () {
  const numbers = [
    900, 833.85, 763.0522655, 690.8287572, 619.6914808, 551.4684548,
    487.484348, 428.4663913, 374.6918668, 326.2927748, 283.0916427,
    244.8593048, 247.5566593, 251.2700092, 255.0390593, 258.8646452,
    262.7476149, 266.6888291, 270.6891616, 274.749499, 278.8707415,
  ];

  const logNumbers = numbers.map(num => Math.log(num));

  const logDifferences = [];
  for (let i = 1; i < logNumbers.length; i++) {
    logDifferences.push(logNumbers[i] - logNumbers[i - 1]);
  }

  const avgLogDifference = logDifferences.reduce((acc, val) => acc + val, 0) / logDifferences.length;

  const tolerance = 0.1;
  const isExponentiallyDecreasing = logDifferences.every(diff => Math.abs(diff - avgLogDifference) < tolerance);

  console.log("Logs:", logNumbers);
  console.log("Logs delta:", logDifferences);
  console.log("Middle value of logs delta:", avgLogDifference);
  console.log("Exponential decrease:", isExponentiallyDecreasing);
}