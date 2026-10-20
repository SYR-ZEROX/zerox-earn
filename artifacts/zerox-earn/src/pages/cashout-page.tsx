import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Coins, CreditCard, Gamepad2, WalletCards } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetCurrentUserQueryKey,
  getGetDashboardQueryKey,
  getGetMyWithdrawalsQueryKey,
  getGetProfileQueryKey,
  useCreateWithdrawal,
  useGetCashoutOptions,
  useGetMyWithdrawals,
} from "@workspace/api-client-react";
import { Form } from "@/components/ui/form";
import { EmptyState, ErrorInline, formatCoins, formatDate, LoadingInline, PageHeader, StatusPill } from "@/components/blocks";

const cashoutSchema = z.object({
  method: z.string().min(1, "Choose a cashout option"),
  amount: z.coerce.number().positive("Enter an amount greater than zero"),
  destination: z.string().min(2, "Enter a wallet address, ID, or account").max(256),
});

type CashoutValues = z.infer<typeof cashoutSchema>;

function optionIcon(category: string) {
  if (category === "Crypto") return Coins;
  if (category === "Gaming") return Gamepad2;
  return CreditCard;
}

export function CashoutPage() {
  const queryClient = useQueryClient();
  const options = useGetCashoutOptions();
  const withdrawals = useGetMyWithdrawals({
    query: { queryKey: getGetMyWithdrawalsQueryKey() },
  });
  const createWithdrawal = useCreateWithdrawal();
  const form = useForm<CashoutValues>({
    resolver: zodResolver(cashoutSchema),
    defaultValues: { method: "", amount: 0, destination: "" },
  });
  const selectedMethod = form.watch("method");
  const selectedOption = options.data?.find((option) => option.id === selectedMethod);

  useEffect(() => {
    if (options.data?.length && !form.getValues("method")) {
      form.setValue("method", options.data[0].id);
    }
  }, [form, options.data]);

  function submit(values: CashoutValues) {
    createWithdrawal.mutate(
      { data: values },
      {
        onSuccess: () => {
          form.reset({ method: values.method, amount: 0, destination: "" });
          void queryClient.invalidateQueries({ queryKey: getGetMyWithdrawalsQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        },
      },
    );
  }

  return (
    <section className="page-content" data-testid="page-cashout">
      <PageHeader eyebrow="REDEEM YOUR REWARDS" title="Cashout shop" description="Choose a payout method and submit a withdrawal request for review." />
      {(options.isLoading || withdrawals.isLoading) && <LoadingInline label="Loading cashout options…" />}
      {options.isError && <ErrorInline message={options.error.message} />}
      {withdrawals.isError && <ErrorInline message={withdrawals.error.message} />}

      {options.data && (
        <div className="cashout-layout">
          <div className="cashout-options-panel">
            <div className="section-heading-row compact-heading">
              <div><span className="eyebrow">AVAILABLE METHODS</span><h2>Choose your reward</h2></div>
              <span className="section-count">{options.data.length} OPTIONS</span>
            </div>
            <div className="cashout-option-grid">
              {options.data.map((option) => {
                const Icon = optionIcon(option.category);
                const selected = selectedMethod === option.id;
                return (
                  <button
                    className={`cashout-option ${selected ? "selected" : ""}`}
                    type="button"
                    key={option.id}
                    onClick={() => form.setValue("method", option.id, { shouldValidate: true })}
                    data-testid={`option-cashout-${option.id}`}
                    aria-pressed={selected}
                  >
                    <span className="cashout-option-icon"><Icon size={18} /></span>
                    <span className="cashout-option-copy"><strong>{option.name}</strong><small>{option.description}</small></span>
                    <span className="cashout-option-min">MIN {formatCoins(option.minimum)} ZX</span>
                    {selected && <span className="cashout-option-check"><Check size={13} /></span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="request-card">
            <span className="eyebrow">NEW REQUEST</span>
            <h2>Cash out</h2>
            <p>Your request will be sent to an admin for review. The coin amount is reserved while it is pending.</p>
            <Form {...form}>
              <form className="stacked-form" onSubmit={form.handleSubmit(submit)} noValidate>
                <input type="hidden" {...form.register("method")} />
                <label className="field-label" htmlFor="cashout-amount">Amount in ZX Coins</label>
                <input id="cashout-amount" type="number" min={selectedOption?.minimum ?? 1} step="1" placeholder="Enter amount" {...form.register("amount")} data-testid="input-cashout-amount" />
                {selectedOption && <small className="field-note">Minimum: {formatCoins(selectedOption.minimum)} ZX</small>}
                {form.formState.errors.amount && <span className="field-error">{form.formState.errors.amount.message}</span>}

                <label className="field-label" htmlFor="cashout-destination">
                  {selectedOption?.category === "Gaming" ? "Player ID" : selectedOption?.category === "Crypto" ? "Wallet address" : "PayPal email"}
                </label>
                <input id="cashout-destination" placeholder="Enter your payout details" {...form.register("destination")} data-testid="input-cashout-destination" />
                {form.formState.errors.destination && <span className="field-error">{form.formState.errors.destination.message}</span>}
                {createWithdrawal.error && <ErrorInline message={createWithdrawal.error.message} />}
                <button type="submit" className="primary-button full-width" disabled={createWithdrawal.isPending || !selectedOption} data-testid="button-submit-cashout">
                  {createWithdrawal.isPending ? "Submitting request…" : "Submit cashout request"}
                </button>
              </form>
            </Form>
            <div className="request-secure-note"><WalletCards size={15} /> Your payout details are visible only to you and site admins.</div>
          </div>
        </div>
      )}

      <div className="section-heading-row activity-heading">
        <div><span className="eyebrow">ACCOUNT HISTORY</span><h2>Your withdrawal requests</h2></div>
        <span className="section-count">{withdrawals.data?.length ?? 0} REQUESTS</span>
      </div>
      {withdrawals.data?.length ? (
        <div className="activity-table">
          {withdrawals.data.map((item) => (
            <div className="activity-row withdrawal-row" key={item.id} data-testid={`row-withdrawal-${item.id}`}>
              <span className="activity-kind-icon activity-withdrawal"><WalletCards size={16} /></span>
              <div className="activity-copy"><strong>{item.method}</strong><small>{formatDate(item.createdAt)} · {item.destination}</small></div>
              <strong className="withdrawal-amount">{formatCoins(item.amount)} ZX</strong>
              <StatusPill status={item.status} />
            </div>
          ))}
        </div>
      ) : !withdrawals.isLoading ? (
        <EmptyState title="No cashouts yet" message="Your requests and their review status will appear here." icon={WalletCards} />
      ) : null}
    </section>
  );
}
