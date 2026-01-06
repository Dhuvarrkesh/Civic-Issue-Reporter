import imageHash from "image-hash";

export const computePhash = (path: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    imageHash.hash(path, 64, true, (err: any, data: string) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
};

export const hammingDistance = (a?: string, b?: string): number => {
  if (!a || !b) return Infinity;
  if (a.length !== b.length) {
    const maxLen = Math.max(a.length, b.length);
    a = a.padStart(maxLen, "0");
    b = b.padStart(maxLen, "0");
  }

  const hexToBits = (hexChar: string) => parseInt(hexChar, 16).toString(2).padStart(4, "0");
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    const bitsA = hexToBits(a[i]);
    const bitsB = hexToBits(b[i]);
    for (let j = 0; j < 4; j++) if (bitsA[j] !== bitsB[j]) dist++;
  }
  return dist;
};
