import numpy as np
from scipy.linalg import lu

# Define matrix A
A = np.array([
    [2, -1, 1],
    [3, 3, 9],
    [3, 3, 5]
], dtype=float)

# Define vector b
b = np.array([2, -1, 4], dtype=float)

print("Matrix A:")
print(A)

print("\nVector b:")
print(b)

# Perform LU Decomposition (PA = LU)
P, L, U = lu(A)

print("\nPermutation Matrix P:")
print(P)

print("\nLower Triangular Matrix L:")
print(L)

print("\nUpper Triangular Matrix U:")
print(U)

# Verify PA = LU
print("\nVerification: PA")
print(np.dot(P, A))

print("\nVerification: LU")
print(np.dot(L, U))

# Solve Ax = b using LU

# Step 1: Solve Ly = Pb
Pb = np.dot(P, b)
y = np.linalg.solve(L, Pb)

# Step 2: Solve Ux = y
x = np.linalg.solve(U, y)

print("\nSolution vector x:")
print(x)

# Final verification Ax = b
print("\nVerification Ax:")
print(np.dot(A, x))
