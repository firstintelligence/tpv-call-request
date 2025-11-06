import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import InputMask from "react-input-mask";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  customerName: z.string().min(1, "Customer name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  province: z.string().min(1, "Province is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  phoneNumber: z.string().min(10, "Valid phone number is required"),
  email: z.string().email("Valid email is required").optional().or(z.literal("")),
  products: z.string().min(1, "Products are required"),
  salesPrice: z.string().min(1, "Sales price is required"),
  paymentOption: z.string().min(1, "Payment option is required"),
  financeCompany: z.string().optional(),
  interestRate: z.string().optional(),
  promotionalTerm: z.string().optional(),
  amortization: z.string().optional(),
  monthlyPayment: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const TpvRequest = () => {
  const { toast } = useToast();
  const [showFinanceFields, setShowFinanceFields] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: "",
      customerName: "",
      address: "",
      city: "",
      province: "",
      postalCode: "",
      phoneNumber: "",
      email: "",
      products: "",
      salesPrice: "",
      paymentOption: "",
      financeCompany: "",
      interestRate: "",
      promotionalTerm: "",
      amortization: "",
      monthlyPayment: "",
    },
  });

  const paymentOption = form.watch("paymentOption");
  const salesPrice = form.watch("salesPrice");
  const financeCompany = form.watch("financeCompany");
  const interestRate = form.watch("interestRate");
  const amortization = form.watch("amortization");

  useEffect(() => {
    setShowFinanceFields(paymentOption === "finance");
    if (paymentOption !== "finance") {
      form.setValue("financeCompany", "");
      form.setValue("interestRate", "");
      form.setValue("promotionalTerm", "");
      form.setValue("amortization", "");
      form.setValue("monthlyPayment", "");
    }
  }, [paymentOption, form]);

  useEffect(() => {
    if (
      showFinanceFields &&
      financeCompany === "Financeit Canada Inc." &&
      salesPrice &&
      interestRate &&
      amortization
    ) {
      const price = parseFloat(salesPrice);
      const rate = parseFloat(interestRate) / 100;
      const months = parseInt(amortization);

      if (!isNaN(price) && !isNaN(rate) && !isNaN(months)) {
        // Calculate admin fee (1.49% of price, max $149)
        const adminFee = Math.min(price * 0.0149, 149);
        const totalAmount = price + adminFee;

        // Calculate monthly payment
        let monthly;
        if (rate === 0) {
          monthly = totalAmount / months;
        } else {
          const monthlyRate = rate / 12;
          monthly =
            (totalAmount * monthlyRate * Math.pow(1 + monthlyRate, months)) /
            (Math.pow(1 + monthlyRate, months) - 1);
        }

        form.setValue("monthlyPayment", monthly.toFixed(2));
      }
    }
  }, [salesPrice, financeCompany, interestRate, amortization, showFinanceFields, form]);

  const onSubmit = async (data: FormValues) => {
    console.log("TPV Request Data:", data);
    
    try {
      toast({
        title: "Initiating Call",
        description: "Starting TPV verification call...",
      });

      // Call the edge function to initiate VAPI call
      const { data: callResult, error } = await supabase.functions.invoke('initiate-tpv-call', {
        body: {
          ...data,
          assistantId: '33a8b0b6-2fc0-4f1f-9f01-02712d52a676',
          phoneNumberId: null, // Optional: add your VAPI phone number ID
        },
      });

      if (error) {
        throw error;
      }

      if (callResult?.success) {
        toast({
          title: "Call Initiated Successfully",
          description: `TPV verification call has been started. Call ID: ${callResult.callId}`,
        });
        form.reset();
      } else {
        throw new Error(callResult?.error || 'Failed to initiate call');
      }
    } catch (error) {
      console.error('Error initiating TPV call:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to initiate verification call',
        variant: "destructive",
      });
    }
  };

  const companies = [
    "George's Plumbing and Heating",
    "Edison Energy",
    "Crown Construction",
    "Marathon Electric",
  ];

  const canadianProvinces = [
    "Alberta",
    "British Columbia",
    "Manitoba",
    "New Brunswick",
    "Newfoundland and Labrador",
    "Northwest Territories",
    "Nova Scotia",
    "Nunavut",
    "Ontario",
    "Prince Edward Island",
    "Quebec",
    "Saskatchewan",
    "Yukon",
  ];

  const hvacProducts = [
    "Heat Pump",
    "Tankless Water Heater",
    "High-Efficiency Furnace",
    "Air Conditioner",
    "Boiler",
    "Ductless Mini-Split",
    "Heat Recovery Ventilator (HRV)",
    "Energy Recovery Ventilator (ERV)",
    "Smart Thermostat",
    "Air Purification System",
    "Humidifier/Dehumidifier",
    "Geothermal Heat Pump",
    "Solar Water Heater",
    "Insulation",
    "Windows and Doors",
    "Programmable Thermostat",
  ];

  const financeCompanies = [
    "Financeit Canada Inc.",
    "UEI Financial",
    "iFinance",
  ];

  const interestRates = [
    "0", "2.99", "3.99", "4.99", "5.99", "6.99", "7.99", "8.99", 
    "9.99", "10.99", "11.99", "12.99", "13.99", "14.99", "15.99", "16.99"
  ];

  const promotionalTerms = ["12", "24", "36", "48", "60"];

  const amortizationPeriods = [
    ...Array.from({ length: 15 }, (_, i) => ((i + 1) * 12).toString()),
    "240"
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">TPV Call Request Form</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select company" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {companies.map((company) => (
                              <SelectItem key={company} value={company}>
                                {company}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter customer name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter city" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="province"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Province</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select province" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {canadianProvinces.map((province) => (
                              <SelectItem key={province} value={province}>
                                {province}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="postalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal Code</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter postal code" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <InputMask
                            mask="(999) 999-9999"
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                          >
                            {(inputProps: any) => (
                              <Input
                                {...inputProps}
                                type="tel"
                                placeholder="(416) 500-5000"
                              />
                            )}
                          </InputMask>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="products"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Products</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {hvacProducts.map((product) => (
                            <SelectItem key={product} value={product}>
                              {product}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="salesPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sales Price (including taxes)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Enter sales price"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="paymentOption"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Option</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select payment option" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="cheque">Cheque</SelectItem>
                            <SelectItem value="finance">Finance</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {showFinanceFields && (
                  <div className="space-y-4 rounded-lg border border-border bg-muted/50 p-4">
                    <h3 className="font-semibold text-lg">Finance Details</h3>

                    <FormField
                      control={form.control}
                      name="financeCompany"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Finance Company</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select finance company" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {financeCompanies.map((company) => (
                                <SelectItem key={company} value={company}>
                                  {company}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="interestRate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Interest Rate</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select interest rate" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {interestRates.map((rate) => (
                                  <SelectItem key={rate} value={rate}>
                                    {rate}%
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="promotionalTerm"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Promotional Term</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select term" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {promotionalTerms.map((term) => (
                                  <SelectItem key={term} value={term}>
                                    {term} months
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="amortization"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amortization</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select amortization" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {amortizationPeriods.map((period) => (
                                  <SelectItem key={period} value={period}>
                                    {period} months
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="monthlyPayment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Monthly Payment</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Auto-calculated"
                                readOnly
                                className="bg-muted"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full" size="lg">
                  Submit TPV Request
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TpvRequest;
