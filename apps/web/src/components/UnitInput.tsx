import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import type { MeasurementUnit } from '@/lib/api';

function normalizeUnitName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function HighlightedUnit({ name, query }: { name: string; query: string }) {
  const index = name.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0 || !query) return <>{name}</>;
  return (
    <>
      {name.slice(0, index)}
      <mark className="rounded bg-primary/20 px-0.5 text-foreground">{name.slice(index, index + query.length)}</mark>
      {name.slice(index + query.length)}
    </>
  );
}

type UnitInputProps = {
  value: string;
  units: MeasurementUnit[];
  onChange: (value: string) => void;
  onAddUnit: (name: string) => Promise<MeasurementUnit>;
  disabled: boolean;
};

export default function UnitInput({ value, units, onChange, onAddUnit, disabled }: UnitInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const normalizedQuery = normalizeUnitName(query);
  const exactMatch = units.some((unit) => normalizeUnitName(unit.name) === normalizedQuery);
  const suggestions = units
    .map((unit) => {
      const normalizedName = normalizeUnitName(unit.name);
      const rank = !normalizedQuery ? 0
        : normalizedName === normalizedQuery ? 0
          : normalizedName.startsWith(normalizedQuery) ? 1
            : normalizedName.includes(normalizedQuery) ? 2
              : null;
      return { unit, rank };
    })
    .filter((entry): entry is { unit: MeasurementUnit; rank: number } => entry.rank !== null)
    .sort((left, right) => left.rank - right.rank
      || Number(right.unit.isPreset) - Number(left.unit.isPreset)
      || left.unit.name.localeCompare(right.unit.name))
    .slice(0, 12);

  async function addUnit() {
    const name = query.replace(/\s+/g, ' ');
    if (!name || exactMatch) return;
    setErrorMessage('');
    setIsAdding(true);
    try {
      const unit = await onAddUnit(name);
      onChange(unit.name);
      setQuery('');
      setIsOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not save this unit.');
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="min-w-0 space-y-1.5">
      <Command shouldFilter={false} className="relative h-auto w-full min-w-0 overflow-visible rounded-md bg-transparent">
        <CommandInput
          className="h-full w-0 min-w-0 flex-1 bg-transparent px-0 py-0 text-left text-base shadow-none focus-visible:ring-0 sm:text-sm"
          wrapperClassName="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 shadow-sm ring-offset-background focus-within:ring-1 focus-within:ring-ring"
          onValueChange={(nextValue) => {
            setQuery(nextValue);
            onChange(nextValue);
            setErrorMessage('');
            setIsOpen(true);
          }}
          onFocus={() => {
            setQuery('');
            setIsOpen(true);
          }}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
          maxLength={32}
          value={isOpen ? query : value}
          placeholder={isOpen ? (value || 'Search or type a unit') : 'Search or type a unit'}
          aria-label="Search or type a measurement unit"
          aria-expanded={isOpen}
          disabled={disabled || isAdding}
        />
        {isOpen && !disabled && (
          <CommandList className="absolute inset-x-0 top-full z-50 mt-1 max-h-64 w-full rounded-md border bg-popover shadow-lg">
            {suggestions.length > 0 ? (
              <CommandGroup heading="Saved units">
                {suggestions.map(({ unit }) => (
                  <CommandItem key={unit.id} value={unit.name} onSelect={() => {
                    onChange(unit.name);
                    setQuery('');
                    setIsOpen(false);
                  }}>
                    <span className="min-w-0 flex-1"><HighlightedUnit name={unit.name} query={query} /></span>
                    <Badge variant={unit.isPreset ? 'secondary' : 'outline'}>{unit.isPreset ? 'Preset' : 'Saved'}</Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <CommandEmpty>No saved unit matches this name.</CommandEmpty>
            )}
            {query && !exactMatch && (
              <CommandItem value={`add ${query}`} onSelect={() => void addUnit()} disabled={isAdding}>
                <Plus aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{isAdding ? 'Adding unit…' : `Add “${query}” unit`}</span>
              </CommandItem>
            )}
          </CommandList>
        )}
      </Command>
      {errorMessage && <span className="block text-xs leading-5 text-destructive">{errorMessage}</span>}
    </div>
  );
}
