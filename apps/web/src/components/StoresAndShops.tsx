import { useEffect, useState, type FormEvent } from 'react';
import { MapPin, Plus, Store as StoreIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { createStore, fetchStores, storeCategories, storeCategoryLabels, type Store, type StoreCategory } from '@/lib/api';

const inputClassName = 'h-10 w-full min-w-0 bg-background text-sm';

export default function StoresAndShops() {
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<StoreCategory>('supermarket');
  const [errorMessage, setErrorMessage] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void fetchStores(controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) setStores(page.items);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : 'Could not load stores and shops.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setIsSaving(true);
    try {
      const store = await createStore({ name: name.trim(), category });
      setStores((current) => [...current, store].sort((left, right) => left.name.localeCompare(right.name)));
      setName('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not save this store or shop.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
      <Card className="min-w-0">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-lg">
              <StoreIcon className="size-5 text-primary" aria-hidden="true" /> Saved places
            </CardTitle>
            <CardDescription>Choose these stores when recording a purchase.</CardDescription>
          </div>
          <Badge variant="secondary">{stores.length} {stores.length === 1 ? 'place' : 'places'}</Badge>
        </CardHeader>
        <CardContent>
          {loadError && (
            <Alert variant="destructive">
              <AlertTitle>Could not load your stores</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}
          {isLoading ? (
            <div className="space-y-3" aria-label="Loading stores and shops">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : loadError ? null : stores.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 text-center">
              <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <MapPin className="size-5" aria-hidden="true" />
              </span>
              <p className="text-sm font-medium">No stores saved yet</p>
              <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                Add the places you shop. They will be ready to select on your next purchase.
              </p>
            </div>
          ) : (
            <ul className="divide-y rounded-lg border">
              {stores.map((store) => (
                <li key={store.id} className="flex min-w-0 items-center justify-between gap-3 px-4 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <StoreIcon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{store.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{storeCategoryLabels[store.category]}</span>
                    </span>
                  </div>
                  <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">{storeCategoryLabels[store.category]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-lg">Add a store or shop</CardTitle>
          <CardDescription>Save a place once, then select it on future receipts.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Label htmlFor="store-name" className="grid gap-2 text-sm font-medium">
              Store or shop name
              <Input
                id="store-name"
                className={inputClassName}
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                placeholder="e.g. Green Market"
                required
                disabled={isSaving}
              />
            </Label>
            <div className="grid gap-2">
              <Label htmlFor="store-category" className="text-sm font-medium">Category</Label>
              <Select value={category} onValueChange={(value) => setCategory(value as StoreCategory)} disabled={isSaving}>
                <SelectTrigger id="store-category" className={inputClassName}>
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {storeCategories.map((value) => (
                    <SelectItem key={value} value={value}>{storeCategoryLabels[value]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {errorMessage && (
              <Alert variant="destructive">
                <AlertTitle>Could not add this place</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={isSaving || !name.trim()}>
              <Plus aria-hidden="true" /> {isSaving ? 'Saving…' : 'Add store or shop'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
