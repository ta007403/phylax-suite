import { classifyPhylaxProbe, isPhylaxBootloader } from './phylax';

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
});
