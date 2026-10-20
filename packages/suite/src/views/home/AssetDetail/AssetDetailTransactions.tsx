import { useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce } from 'react-use';

import { Translation, useTranslation } from '@suite/intl';
import {
    selectWalletAssetAccountKeys,
    selectWalletAssetSymbol,
    selectWalletAssetTransactions,
} from '@suite-common/assets';
import { getTxsPerPage } from '@suite-common/suite-utils';
import {
    hasNetworkPotentialFraudTransactions,
    isPhishingTransaction,
    selectNetworkTokenDefinitions,
} from '@suite-common/token-definitions';
import {
    type SearchAccountLabels,
    advancedSearchTransactions,
} from '@suite-common/transaction-search';
import { getNetwork } from '@suite-common/wallet-config';
import {
    type WalletAssetKey,
    fetchAllTransactionsForAccountThunk,
    selectAccountByKey,
    selectActiveDustPhishingThreshold,
    selectBaseCurrency,
    selectHistoricFiatRates,
    selectIsHideSuspiciousTransactions,
    selectIsLoadingAccountTransactions,
    selectPhishingTransactions,
} from '@suite-common/wallet-core';
import { type Account, type WalletAccountTransaction } from '@suite-common/wallet-types';
import { groupTransactionsByDate, isPending, sortByBlockHeight } from '@suite-common/wallet-utils';
import { Card, Column, Icon, Input, Row, Text } from '@trezor/components';
import { useServices } from '@trezor/dependency-injection';
import { MagnifyingGlassIcon } from '@trezor/icons';
import { injectDispatch } from '@trezor/redux-utils';

import { DashboardSection } from 'src/components/dashboard';
import { Pagination } from 'src/components/wallet';
import { TransactionItem } from 'src/components/wallet/TransactionItem/TransactionItem';
import { useSelector } from 'src/hooks/suite';
import { selectAccountLabelsForSearch } from 'src/selectors/suite/selectAccountLabelsForSearch';
import { NoSearchResults } from 'src/views/wallet/transactions/TransactionList/NoSearchResults';
import { SkeletonTransactionItem } from 'src/views/wallet/transactions/TransactionList/SkeletonTransactionItem';
import { FilterAction } from 'src/views/wallet/transactions/TransactionList/TransactionListActions/FilterAction';
import { PendingGroupHeader } from 'src/views/wallet/transactions/TransactionList/TransactionsGroup/PendingGroupHeader';
import { TransactionsGroup } from 'src/views/wallet/transactions/TransactionList/TransactionsGroup/TransactionsGroup';
import { NoVisibleTransactions } from 'src/views/wallet/transactions/TransactionList/WalletTransactionList';

const SEARCH_DEBOUNCE_MS = 200;

const NO_TXIDS: string[] = [];

const NO_LABELS: SearchAccountLabels = {
    accountLabel: null,
    outputLabels: new Map(),
    addressLabels: new Map(),
};

const isOfAccount = (transaction: WalletAccountTransaction, account: Account) =>
    transaction.descriptor === account.descriptor &&
    transaction.symbol === account.symbol &&
    transaction.deviceState === account.deviceState;

type AssetTransactionGroupsProps = {
    transactions: WalletAccountTransaction[];
    accounts: readonly Account[];
    isPending: boolean;
};

const AssetTransactionGroups = ({
    transactions,
    accounts,
    isPending: arePending,
}: AssetTransactionGroupsProps) => {
    const baseCurrencyCode = useSelector(selectBaseCurrency);
    const groups = useMemo(() => groupTransactionsByDate(transactions, 'day'), [transactions]);

    return Object.entries(groups).map(([dateKey, groupTransactions], groupIndex) => {
        const [firstTransaction] = groupTransactions;
        const groupAccount =
            firstTransaction && accounts.find(account => isOfAccount(firstTransaction, account));

        if (firstTransaction === undefined || groupAccount === undefined) {
            return null;
        }

        return (
            <TransactionsGroup
                key={dateKey}
                dateKey={dateKey}
                symbol={firstTransaction.symbol}
                account={groupAccount}
                transactions={groupTransactions}
                baseCurrencyCode={baseCurrencyCode}
                isPending={arePending}
                index={groupIndex}
            >
                {groupTransactions.map((transaction, index) => {
                    const account = accounts.find(candidate => isOfAccount(transaction, candidate));

                    return (
                        account && (
                            <TransactionItem
                                key={`${account.key}/${transaction.txid}`}
                                transaction={transaction}
                                isPending={arePending}
                                accountKey={account.key}
                                network={getNetwork(transaction.symbol)}
                                accountType={account.accountType}
                                index={index}
                                disableBumpFee
                                isAccountShown
                            />
                        )
                    );
                })}
            </TransactionsGroup>
        );
    });
};

type AssetDetailTransactionsProps = {
    assetKey: WalletAssetKey;
};

export const AssetDetailTransactions = ({ assetKey }: AssetDetailTransactionsProps) => {
    const { dispatch } = useServices(injectDispatch);
    const { translationString } = useTranslation();
    const sectionRef = useRef<HTMLDivElement>(null);

    const symbol = useSelector(state => selectWalletAssetSymbol(state, assetKey));
    const accountKeys = useSelector(state => selectWalletAssetAccountKeys(state, assetKey));
    const transactions = useSelector(state => selectWalletAssetTransactions(state, assetKey));
    const accounts = useSelector(state =>
        accountKeys
            .map(accountKey => selectAccountByKey(state, accountKey))
            .filter((account): account is Account => account !== null),
    );
    const accountLabels = useSelector(state =>
        accounts.map(account => selectAccountLabelsForSearch(state, account)),
    );
    const isLoading = useSelector(state =>
        accountKeys.some(accountKey => selectIsLoadingAccountTransactions(state, accountKey)),
    );

    const isHidingSuspicious = useSelector(
        state =>
            symbol !== undefined &&
            hasNetworkPotentialFraudTransactions(symbol) &&
            selectIsHideSuspiciousTransactions(state, symbol),
    );
    const tokenDefinitions = useSelector(state =>
        symbol === undefined ? undefined : selectNetworkTokenDefinitions(state, symbol),
    );
    const historicRates = useSelector(selectHistoricFiatRates);
    const txsMarkedAsNotScamByAccount = useSelector(selectPhishingTransactions);
    const dustThreshold = useSelector(selectActiveDustPhishingThreshold);

    const visibleTransactions = useMemo(() => {
        if (!isHidingSuspicious) {
            return transactions;
        }

        return transactions.filter(transaction => {
            const account = accounts.find(candidate => isOfAccount(transaction, candidate));

            return !isPhishingTransaction({
                transaction,
                tokenDefinitions,
                historicRates,
                txsMarkedAsNotScam:
                    (account && txsMarkedAsNotScamByAccount[account.key]) ?? NO_TXIDS,
                dustThreshold,
            }).isPhishing;
        });
    }, [
        isHidingSuspicious,
        transactions,
        accounts,
        tokenDefinitions,
        historicRates,
        txsMarkedAsNotScamByAccount,
        dustThreshold,
    ]);

    useEffect(() => {
        accountKeys.forEach(accountKey => {
            dispatch(fetchAllTransactionsForAccountThunk({ accountKey }));
        });
    }, [accountKeys, dispatch]);

    const [searchQuery, setSearchQuery] = useState('');
    const [search, setSearch] = useState<{
        query: string;
        results: readonly WalletAccountTransaction[];
    }>({ query: '', results: [] });
    const isSearching = searchQuery.trim() !== '';

    useDebounce(
        () => {
            if (!isSearching) {
                return;
            }

            const results = accounts
                .flatMap((account, index) =>
                    advancedSearchTransactions(
                        visibleTransactions.filter(transaction =>
                            isOfAccount(transaction, account),
                        ),
                        accountLabels[index] ?? NO_LABELS,
                        searchQuery,
                    ),
                )
                .sort(sortByBlockHeight);

            setSearch({ query: searchQuery, results });
        },
        SEARCH_DEBOUNCE_MS,
        [visibleTransactions, accounts, accountLabels, searchQuery, isSearching],
    );

    const isSearchPending = isSearching && search.query !== searchQuery;
    const hasSearchResults = isSearching && search.query !== '';
    const searchedTransactions = hasSearchResults ? search.results : visibleTransactions;

    const [currentPage, setCurrentPage] = useState(1);
    const perPage = symbol === undefined ? 0 : getTxsPerPage(getNetwork(symbol).networkType);

    const pendingTransactions = useMemo(
        () => searchedTransactions.filter(isPending),
        [searchedTransactions],
    );
    const confirmedTransactions = useMemo(
        () => searchedTransactions.filter(transaction => !isPending(transaction)),
        [searchedTransactions],
    );
    const pageTransactions = useMemo(
        () => confirmedTransactions.slice((currentPage - 1) * perPage, currentPage * perPage),
        [confirmedTransactions, currentPage, perPage],
    );

    const onPageSelected = (page: number) => {
        setCurrentPage(page);
        sectionRef.current?.scrollIntoView();
    };

    const onSearch = (query: string) => {
        setCurrentPage(1);
        setSearchQuery(query);
    };

    if (symbol === undefined) {
        return null;
    }

    const hasNoTransactions = transactions.length === 0;

    const renderContent = () => {
        if (hasNoTransactions && isLoading) {
            return (
                <Column gap={16}>
                    <SkeletonTransactionItem />
                    <SkeletonTransactionItem />
                    <SkeletonTransactionItem />
                </Column>
            );
        }

        if (!hasNoTransactions && visibleTransactions.length === 0) {
            return <NoVisibleTransactions />;
        }

        if (hasNoTransactions) {
            return (
                <Card>
                    <Column alignItems="center">
                        <Text typographyStyle="body-sm" intent="neutral" priority="secondary">
                            <Translation id="TR_ASSET_DETAIL_NO_TRANSACTIONS" />
                        </Text>
                    </Column>
                </Card>
            );
        }

        if (isSearching && !isSearchPending && searchedTransactions.length === 0) {
            return <NoSearchResults />;
        }

        return (
            <Column gap={40}>
                {pendingTransactions.length > 0 && (
                    <>
                        <PendingGroupHeader txsCount={pendingTransactions.length} />
                        <AssetTransactionGroups
                            transactions={pendingTransactions}
                            accounts={accounts}
                            isPending
                        />
                    </>
                )}
                <AssetTransactionGroups
                    transactions={pageTransactions}
                    accounts={accounts}
                    isPending={false}
                />
            </Column>
        );
    };

    return (
        <DashboardSection
            ref={sectionRef}
            heading={<Translation id="TR_ALL_TRANSACTIONS" />}
            actions={
                <Row gap={12}>
                    <Input
                        data-testid="@asset-detail/search"
                        placeholder={translationString('TR_SEARCH_TRANSACTIONS')}
                        value={searchQuery}
                        onChange={event => onSearch(event.target.value)}
                        onClear={() => onSearch('')}
                        size="small"
                        leftContent={
                            <Icon
                                as={MagnifyingGlassIcon}
                                intent="neutral"
                                priority="secondary"
                                size={16}
                            />
                        }
                    />
                    {hasNetworkPotentialFraudTransactions(symbol) && (
                        <FilterAction symbol={symbol} />
                    )}
                </Row>
            }
            data-testid="@asset-detail/transactions"
        >
            <Column gap={32} padding={{ top: 16 }}>
                {renderContent()}
                {confirmedTransactions.length > perPage && (
                    <Pagination
                        currentPage={currentPage}
                        perPage={perPage}
                        totalItems={confirmedTransactions.length}
                        onPageSelected={onPageSelected}
                        explicitNavigation
                    />
                )}
            </Column>
        </DashboardSection>
    );
};
