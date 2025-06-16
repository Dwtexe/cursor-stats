import * as vscode from 'vscode';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { log } from './logger';
import { CurrencyRates, CurrencyCache } from '../interfaces/types';
import { getExtensionContext } from '../extension';

const CURRENCY_API_URL = 'https://latest.currency-api.pages.dev/v1/currencies/usd.json';
const CURRENCY_CACHE_FILE = 'currency-rates.json';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// List of supported currencies (excluding cryptocurrencies)
// Updated to list only currency codes; names will be localized via i18n
export const SUPPORTED_CURRENCIES: string[] = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'AUD',
  'CAD',
  'CHF',
  'CNY',
  'INR',
  'MXN',
  'BRL',
  'RUB',
  'KRW',
  'SGD',
  'NZD',
  'TRY',
  'ZAR',
  'SEK',
  'NOK',
  'DKK',
  'HKD',
  'TWD',
  'PHP',
  'THB',
  'IDR',
  'VND',
  'ILS',
  'AED',
  'SAR',
  'MYR',
  'PLN',
  'CZK',
  'HUF',
  'RON',
  'BGN',
  'HRK',
  'EGP',
  'QAR',
  'KWD',
  'MAD',
];

export function getCurrencySymbol(currencyCode: string): string {
  const symbolMap: { [key: string]: string } = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$',
    CHF: 'CHF',
    CNY: '¥',
    INR: '₹',
    MXN: 'Mex$',
    BRL: 'R$',
    RUB: '₽',
    KRW: '₩',
    SGD: 'S$',
    NZD: 'NZ$',
    TRY: '₺',
    ZAR: 'R',
    SEK: 'kr',
    NOK: 'kr',
    DKK: 'kr',
    HKD: 'HK$',
    TWD: 'NT$',
    PHP: '₱',
    THB: '฿',
    IDR: 'Rp',
    VND: '₫',
    ILS: '₪',
    AED: 'د.إ',
    SAR: '﷼',
    MYR: 'RM',
    PLN: 'zł',
    CZK: 'Kč',
    HUF: 'Ft',
    RON: 'lei',
    BGN: 'лв',
    HRK: 'kn',
    EGP: 'E£',
    QAR: 'ر.ق',
    KWD: 'د.ك',
    MAD: 'د.م.',
  };

  return symbolMap[currencyCode] || currencyCode;
}

export async function getCachedRates(): Promise<CurrencyRates | null> {
  try {
    const context = getExtensionContext();
    const cachePath = path.join(context.extensionPath, CURRENCY_CACHE_FILE);

    if (fs.existsSync(cachePath)) {
      const cacheData = fs.readFileSync(cachePath, 'utf8');
      const cache: CurrencyCache = JSON.parse(cacheData);

      // Check if cache is still valid (less than 24 hours old)
      if (Date.now() - cache.timestamp < CACHE_EXPIRY_MS) {
        log('[Currency] Using cached exchange rates', {
          date: cache.rates.date,
          cacheAge: Math.round((Date.now() - cache.timestamp) / 1000 / 60) + ' minutes',
        });
        return cache.rates;
      }

      log('[Currency] Cache expired, will fetch new rates');
    } else {
      log('[Currency] No cache file found');
    }
  } catch (error: any) {
    log('[Currency] Error reading cache: ' + error.message, true);
  }

  return null;
}

export async function saveCurrencyCache(rates: CurrencyRates): Promise<void> {
  try {
    const context = getExtensionContext();
    const cachePath = path.join(context.extensionPath, CURRENCY_CACHE_FILE);

    const cache: CurrencyCache = {
      rates,
      timestamp: Date.now(),
    };

    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
    log('[Currency] Exchange rates cached successfully');
  } catch (error: any) {
    log('[Currency] Error saving cache: ' + error.message, true);
  }
}

export async function fetchExchangeRates(): Promise<CurrencyRates> {
  try {
    // First check if we have a valid cache
    const cachedRates = await getCachedRates();
    if (cachedRates) {
      return cachedRates;
    }

    // If not, fetch from API
    log('[Currency] Fetching exchange rates from API');
    const response = await axios.get<CurrencyRates>(CURRENCY_API_URL);
    log('[Currency] Received exchange rates', {
      date: response.data.date,
      currencies: Object.keys(response.data.usd).length,
    });

    // Save to cache
    await saveCurrencyCache(response.data);

    return response.data;
  } catch (error: any) {
    log('[Currency] Error fetching exchange rates: ' + error.message, true);
    throw new Error(`Failed to fetch currency exchange rates: ${error.message}`);
  }
}

export async function convertAmount(
  amount: number,
  targetCurrency: string,
): Promise<{ value: number; symbol: string }> {
  try {
    // If target is USD, no conversion needed
    if (targetCurrency === 'USD') {
      return { value: amount, symbol: '$' };
    }

    // Get exchange rates
    const rates = await fetchExchangeRates();

    // Get the exchange rate for the target currency (rates are USD to target)
    const rate = rates.usd[targetCurrency.toLowerCase()];

    if (!rate) {
      log(`[Currency] Exchange rate not found for ${targetCurrency}`, true);
      return { value: amount, symbol: '$' }; // Fall back to USD
    }

    // Convert the amount
    const convertedValue = amount * rate;

    // Get the currency symbol
    const symbol = getCurrencySymbol(targetCurrency);

    log(
      `[Currency] Converted $${amount} to ${symbol}${convertedValue.toFixed(2)} (${targetCurrency})`,
    );

    return { value: convertedValue, symbol };
  } catch (error: any) {
    log('[Currency] Conversion error: ' + error.message, true);
    return { value: amount, symbol: '$' }; // Fall back to USD
  }
}

export function formatCurrency(amount: number, currencyCode: string, decimals: number = 2): string {
  const symbol = getCurrencySymbol(currencyCode);

  // Special formatting for some currencies
  if (currencyCode === 'JPY' || currencyCode === 'KRW') {
    // These currencies typically don't use decimal places
    return `${symbol}${Math.round(amount)}`;
  }

  return `${symbol}${amount.toFixed(decimals)}`;
}

export function getCurrentCurrency(): string {
  const config = vscode.workspace.getConfiguration('cursorStats');
  return config.get<string>('currency', 'USD');
}

export async function convertAndFormatCurrency(
  amount: number,
  decimals: number = 2,
): Promise<string> {
  const currencyCode = getCurrentCurrency();

  if (currencyCode === 'USD') {
    return `$${amount.toFixed(decimals)}`;
  }

  try {
    const { value, symbol } = await convertAmount(amount, currencyCode);
    return formatCurrency(value, currencyCode, decimals);
  } catch (error) {
    return `$${amount.toFixed(decimals)}`;
  }
}
