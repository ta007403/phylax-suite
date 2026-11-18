import { classifyPhylaxProbe, isPhylaxBootloader, isRegularTrezor } from './phylax';

describe('PHYLAX detection', () => {
    it('counts only definite answers', () => {
        expect(classifyPhylaxProbe(undefined)).toBe('main');
        expect(
            classifyPhylaxProbe({
                code: 'Failure_UnexpectedMessage',
                message: 'fsm_msg_phylax.h:29:Not a PHYLAX main block',
            }),
        ).toBe('key');
        expect(
            classifyPhylaxProbe({ code: 'Failure_UnexpectedMessage', message: 'Unknown message' }),
        ).toBe('stock');
        expect(classifyPhylaxProbe({ code: 'Device_CallInProgress', message: 'busy' })).toBe(
            'unknown',
        );
        expect(classifyPhylaxProbe({ message: 'Transport error' })).toBe('unknown');
    });

    it('knows the PHYLAX bootloaders', () => {
        expect(
            isPhylaxBootloader({
                bootloader_hash: '95B80F96CF3F713F01711B28B16C4BE5FEF3A8B4A65412885DC6C87934C13DAB',
            }),
        ).toBe(true);
        expect(isPhylaxBootloader({ bootloader_hash: '00'.repeat(32) })).toBe(false);
        expect(isPhylaxBootloader({ bootloader_hash: null })).toBe(false);
        expect(isPhylaxBootloader(undefined)).toBe(false);
    });

    it('calls a device a regular Trezor only when that is certain', () => {
        const t1 = { internal_model: 'T1B1', bootloader_hash: '00'.repeat(32) };
        const phylaxBl = {
            internal_model: 'T1B1',
            bootloader_hash: '95b80f96cf3f713f01711b28b16c4be5fef3a8b4a65412885dc6c87934c13dab',
        };

        // Trezor One: only once its firmware answered the probe as Trezor firmware
        expect(isRegularTrezor({ features: t1, phylax: false })).toBe(true);
        expect(isRegularTrezor({ features: t1 })).toBe(false);
        expect(isRegularTrezor({ features: t1, phylax: true })).toBe(false);
        expect(isRegularTrezor({ features: t1, phylax: false, phylaxKey: true })).toBe(false);
        expect(isRegularTrezor({ features: phylaxBl, phylax: false })).toBe(false);
        // other models are never PHYLAX blocks
        expect(isRegularTrezor({ features: { internal_model: 'T2T1' } })).toBe(true);
        expect(isRegularTrezor({ features: { internal_model: 'T3B1' } })).toBe(true);
        expect(isRegularTrezor({ features: undefined, phylax: false })).toBe(false);
    });
});
