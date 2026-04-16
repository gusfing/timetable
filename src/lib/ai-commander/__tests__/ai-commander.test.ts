// Basic tests for AI Commander

import { describe, it, expect, beforeEach } from '@jest/globals';
import { EntityExtractor } from '../entity-extractor';
import { LRUCache } from '../cache';

describe('EntityExtractor', () => {
  let extractor: EntityExtractor;

  beforeEach(() => {
    extractor = new EntityExtractor();
  });

  it('should extract teacher names from command', () => {
    const command = 'Assign Math to teacher John Smith for Class 5A';
    const entities = extractor.extractEntities(command);
    
    expect(entities.teachers).toContain('John Smith');
  });

  it('should extract class names from command', () => {
    const command = 'Assign Math to John Smith for Class 5A on Monday';
    const entities = extractor.extractEntities(command);
    
    expect(entities.classes).toContain('5A');
  });

  it('should extract day names from command', () => {
    const command = 'Show me all classes on Monday';
    const entities = extractor.extractEntities(command);
    
    expect(entities.days).toContain('monday');
  });

  it('should extract period numbers from command', () => {
    const command = 'Assign Math for period 3';
    const entities = extractor.extractEntities(command);
    
    expect(entities.periods).toContain(3);
  });

  it('should extract Period Zero', () => {
    const command = 'Assign morning assembly for period zero';
    const entities = extractor.extractEntities(command);
    
    expect(entities.periods).toContain(0);
  });

  it('should convert day names to numbers', () => {
    expect(extractor.getDayNumber('monday')).toBe(1);
    expect(extractor.getDayNumber('friday')).toBe(5);
    expect(extractor.getDayNumber('sunday')).toBe(0);
  });
});

describe('LRUCache', () => {
  it('should store and retrieve values', () => {
    const cache = new LRUCache<string>(3);
    
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should evict oldest entry when at capacity', () => {
    const cache = new LRUCache<string>(2);
    
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3'); // Should evict key1
    
    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBe('value2');
    expect(cache.get('key3')).toBe('value3');
  });

  it('should expire entries after TTL', async () => {
    const cache = new LRUCache<string>(10, 100); // 100ms TTL
    
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));
    
    expect(cache.get('key1')).toBeUndefined();
  });

  it('should update LRU order on access', () => {
    const cache = new LRUCache<string>(2);
    
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.get('key1'); // Access key1, making it most recent
    cache.set('key3', 'value3'); // Should evict key2, not key1
    
    expect(cache.get('key1')).toBe('value1');
    expect(cache.get('key2')).toBeUndefined();
    expect(cache.get('key3')).toBe('value3');
  });
});
