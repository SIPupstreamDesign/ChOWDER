export class KeyedSerialExecutor {
    private readonly pendingByKey = new Map<string, Promise<void>>();

    /** Serialize one key without blocking operations for unrelated keys. */
    async run<T>(key: string, operation: () => Promise<T>): Promise<T> {
        const previousOperation = this.pendingByKey.get(key) ?? Promise.resolve();
        const currentOperation = previousOperation.then(operation);
        const queueTail = currentOperation.then(
            (): void => { },
            (): void => { },
        );
        this.pendingByKey.set(key, queueTail);

        try {
            return await currentOperation;
        } finally {
            if (this.pendingByKey.get(key) === queueTail) {
                this.pendingByKey.delete(key);
            }
        }
    }
}