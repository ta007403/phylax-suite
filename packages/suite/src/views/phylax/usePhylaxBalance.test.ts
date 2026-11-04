import { mapLimited } from './usePhylaxBalance';

describe('PHYLAX balance lookups', () => {
    it('runs at most `limit` lookups at a time and keeps the order', async () => {
        let running = 0;
        let maxRunning = 0;
        const items = Array.from({ length: 23 }, (_, i) => i);
        const results = await mapLimited(items, 4, async item => {
            running++;
            maxRunning = Math.max(maxRunning, running);
            await new Promise(resolve => setTimeout(resolve, (item % 5) * 2));
            running--;

            return item * 10;
        });

        expect(maxRunning).toBe(4);
        expect(results).toEqual(items.map(i => i * 10));
    });

    it('handles fewer items than the limit, and none', async () => {
        expect(await mapLimited([1, 2], 4, i => Promise.resolve(i + 1))).toEqual([2, 3]);
        expect(await mapLimited([], 4, (i: number) => Promise.resolve(i))).toEqual([]);
    });
});
