import { Translation } from '@suite/intl';

import { PageHeader } from 'src/components/suite/layouts/SuiteLayout';
import { BasicName } from 'src/components/suite/layouts/SuiteLayout/PageHeader/PageNames/BasicName';
import { useLayout } from 'src/hooks/suite';

import { PhylaxPage } from './PhylaxPage';

// PHYLAX Blocks (fork): the stack of blocks and its saved multisig wallets.
const PhylaxView = () => {
    useLayout(
        'PHYLAX Blocks',
        <PageHeader>
            <BasicName>
                <Translation id="TR_PHYLAX" />
            </BasicName>
        </PageHeader>,
    );

    return <PhylaxPage />;
};

export default PhylaxView;
