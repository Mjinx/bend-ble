export const exponentialBackoff = async <T>(
  { max, delay, signal }: { max: number; delay: number; signal?: AbortSignal },
  toTry: () => Promise<T>,
  success: (result: T) => void,
  fail: (error: unknown) => void
) => {
  try {
    signal?.throwIfAborted();
    const result = await toTry();
    success(result);
    return true;
  } catch (error) {
    if (signal?.aborted) {
      fail(error);
      return false;
    }
    if (max === 0) {
      fail(error);
      return false;
    }

    timeLog(`Retrying in ${delay}s... (${max} tries left)`);
    console.debug(`Operation failed ${error}`);

    const newPromise = new Promise<boolean>((resolve) => {
      setTimeout(async () => {
        resolve(
          await exponentialBackoff(
            { max: --max, delay: delay * 2, signal },
            toTry,
            success,
            fail
          )
        );
      }, delay * 1000);
    });
    return await newPromise;
  }
};

export const timeLog = (text: string) =>
  console.log(`[${new Date().toJSON()}] ${text}`);
